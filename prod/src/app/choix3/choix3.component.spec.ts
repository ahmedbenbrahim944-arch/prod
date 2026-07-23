import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Choix3Component } from './choix3.component';

describe('Choix3Component', () => {
  let component: Choix3Component;
  let fixture: ComponentFixture<Choix3Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Choix3Component]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(Choix3Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
