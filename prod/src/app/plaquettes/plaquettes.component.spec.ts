import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlaquettesComponent } from './plaquettes.component';

describe('PlaquettesComponent', () => {
  let component: PlaquettesComponent;
  let fixture: ComponentFixture<PlaquettesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlaquettesComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlaquettesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
